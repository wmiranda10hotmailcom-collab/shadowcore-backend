const supabase = require('../lib/supabase');
const { handleCors } = require('../utils/cors');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  const hotmartToken = process.env.HOTMART_TOKEN;
  const receivedToken = req.headers['hottoken'];

  if (hotmartToken && receivedToken !== hotmartToken) {
    logger.error('Invalid Hotmart token');
    return sendError(res, 'Unauthorized', 401);
  }

  try {
    const body = req.body;
    logger.info('Hotmart event received', { event: body.event, email: body.data?.buyer?.email });

    const { event, data } = body;

    if (!data || !data.buyer) {
      return sendError(res, 'Buyer data missing', 400);
    }

    const email = data.buyer.email;
    const transactionId = data.purchase?.transaction;
    const planType = data.purchase?.offer_code || "standard";

    // 1. Buscar ou Criar Usuário
    let { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let userId = profile?.id;

    if (!profile) {
      logger.info('User not found. Creating new user', { email });
      
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { source: "hotmart" }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          const { data: usersList } = await supabase.auth.admin.listUsers();
          const found = usersList.users.find(u => u.email === email);
          if (found) userId = found.id;
        } else {
          throw authError;
        }
      } else {
        userId = authUser.user.id;
      }

      // Garantir profile
      const { data: checkProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      
      if (!checkProfile) {
        await supabase.from("profiles").insert({ id: userId, email: email });
      }
    }

    // 2. Calcular expiração
    let durationDays = 30;
    const productName = data.product?.name?.toLowerCase() || "";
    if (planType.toLowerCase().includes("trimestral") || productName.includes("trimestral")) {
      durationDays = 90;
    } else if (planType.toLowerCase().includes("anual") || productName.includes("anual")) {
      durationDays = 365;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // 3. Processar Eventos
    const successEvents = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE", "SUBSCRIPTION_RENEWED"];
    const failEvents = ["PURCHASE_CANCELED", "PURCHASE_REFUNDED", "PURCHASE_DELAYED", "PURCHASE_CHARGEBACK"];

    if (successEvents.includes(event)) {
      logger.info('Activating/Renewing access', { email, userId });
      
      await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_plan: planType,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq("id", userId);

      await supabase.from("subscriptions").upsert({
        user_id: userId,
        status: "active",
        plan: planType,
        current_period_end: expiresAt.toISOString(),
        hotmart_transaction_id: transactionId
      }, { onConflict: "user_id" });

    } else if (failEvents.includes(event)) {
      logger.info('Deactivating access', { email, userId });
      
      await supabase
        .from("profiles")
        .update({ subscription_status: "inactive" })
        .eq("id", userId);

      await supabase
        .from("subscriptions")
        .update({ status: "inactive" })
        .eq("user_id", userId);
    }

    return sendSuccess(res, 'Event processed', { userId });

  } catch (error) {
    logger.error('Error processing Hotmart webhook', error);
    return sendError(res, 'Internal server error', 500, error.message);
  }
};
