const Subscription = require('../models/Subscription');
const {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Payment,
  Preference,
  WebhookSignatureValidator
} = require('mercadopago');

const DEFAULT_AMOUNT = Number(process.env.SUBSCRIPTION_AMOUNT || 1);
const DEFAULT_DAYS = Number(process.env.SUBSCRIPTION_DAYS || 30);

function getMercadoPagoClient() {
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    return null;
  }

  return new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    options: { timeout: 5000 }
  });
}

function getPaymentId(req) {
  return req.query.id || req.query['data.id'] || req.body?.data?.id || req.body?.id;
}

function getNotificationType(req) {
  return req.query.type || req.body?.type;
}

function isMercadoPagoSimulation(req) {
  const paymentId = getPaymentId(req);
  return req.body?.live_mode === false && String(paymentId) === '123456';
}

function validateMercadoPagoWebhook(req) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  WebhookSignatureValidator.validate({
    xSignature: req.headers['x-signature'],
    xRequestId: req.headers['x-request-id'],
    dataId: req.query['data.id'] || req.query.id || req.body?.data?.id || req.body?.id,
    secret,
    toleranceSeconds: 300
  });

  return true;
}

async function processMercadoPagoPayment(paymentId, { expectedUserId } = {}) {
  const client = getMercadoPagoClient();

  if (!paymentId || !client) {
    return { processed: false, reason: 'missing_payment_or_client' };
  }

  const paymentClient = new Payment(client);
  const payment = await paymentClient.get({ id: paymentId });

  if (payment.status !== 'approved') {
    return { processed: false, status: payment.status, payment };
  }

  const paidPayment = await Subscription.markPaymentPaid({
    providerPaymentId: String(payment.id),
    providerPreferenceId: payment.preference_id ? String(payment.preference_id) : null,
    localPaymentId: payment.external_reference,
    userId: expectedUserId,
    rawPayload: payment
  });

  return {
    processed: Boolean(paidPayment),
    status: payment.status,
    payment,
    subscriptionPayment: paidPayment
  };
}

async function createMercadoPagoPreference({ user, paymentId, amount }) {
  const client = getMercadoPagoClient();
  if (!client) {
    return {
      provider: 'manual',
      preferenceId: null,
      paymentUrl: process.env.PAYMENT_FALLBACK_URL || null
    };
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
  const body = {
    items: [
      {
        title: 'Entrega Financeira - 30 dias de acesso',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: amount
      }
    ],
    payer: {
      name: user.nome,
      email: user.email
    },
    external_reference: paymentId,
    notification_url: publicBaseUrl ? `${publicBaseUrl}/api/subscription/webhook/mercado-pago` : undefined,
    back_urls: publicBaseUrl ? {
      success: `${publicBaseUrl}/app?payment=success`,
      pending: `${publicBaseUrl}/app?payment=pending`,
      failure: `${publicBaseUrl}/app?payment=failure`
    } : undefined,
    auto_return: publicBaseUrl ? 'approved' : undefined
  };

  const preferenceClient = new Preference(client);
  const data = await preferenceClient.create({ body });

  return {
    provider: 'mercado_pago',
    preferenceId: data.id,
    paymentUrl: data.init_point || data.sandbox_init_point
  };
}

async function status(req, res) {
  const data = await Subscription.getSubscription(req.user.id);
  return res.json(data);
}

async function renew(req, res) {
  try {
    const amount = Number(req.body?.amount || DEFAULT_AMOUNT);
    const days = Number(req.body?.days || DEFAULT_DAYS);
    const initialPayment = await Subscription.createPayment({
      userId: req.user.id,
      amount,
      daysGranted: days,
      provider: 'mercado_pago'
    });

    const preference = await createMercadoPagoPreference({
      user: req.user,
      paymentId: initialPayment.id,
      amount
    });

    const payment = await Subscription.updatePaymentPreference(initialPayment.id, {
      provider: preference.provider,
      preferenceId: preference.preferenceId,
      paymentUrl: preference.paymentUrl
    });

    return res.status(201).json({
      payment,
      payment_url: preference.paymentUrl,
      message: preference.paymentUrl
        ? 'Link de pagamento criado.'
        : 'Pagamento manual pendente. Configure Mercado Pago ou PAYMENT_FALLBACK_URL.'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro ao criar pagamento.' });
  }
}

async function mercadoPagoWebhook(req, res) {
  try {
    const notificationType = getNotificationType(req);
    if (notificationType && notificationType !== 'payment') {
      return res.status(200).json({ received: true, ignored: notificationType });
    }

    if (isMercadoPagoSimulation(req)) {
      return res.status(200).json({ received: true, simulated: true });
    }

    const paymentId = getPaymentId(req);

    try {
      validateMercadoPagoWebhook(req);
    } catch (error) {
      if (!(error instanceof InvalidWebhookSignatureError)) {
        throw error;
      }
      console.warn('Mercado Pago webhook com assinatura invalida; confirmando pagamento pela API.', {
        paymentId,
        notificationId: req.body?.id
      });
    }

    const result = await processMercadoPagoPayment(paymentId);

    return res.status(200).json({ received: true, processed: result.processed });
  } catch (error) {
    console.error('Erro ao processar webhook Mercado Pago:', error.message);
    return res.status(200).json({ received: true });
  }
}

async function syncPayment(req, res) {
  try {
    const paymentId = req.body?.payment_id || req.query.payment_id || req.query.collection_id || req.body?.collection_id;
    const result = await processMercadoPagoPayment(paymentId, { expectedUserId: req.user.id });
    const data = await Subscription.getSubscription(req.user.id);

    return res.json({
      processed: result.processed,
      payment_status: result.status || null,
      subscription: data.subscription,
      payments: data.payments
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro ao sincronizar pagamento.' });
  }
}

module.exports = {
  status,
  renew,
  syncPayment,
  mercadoPagoWebhook
};
