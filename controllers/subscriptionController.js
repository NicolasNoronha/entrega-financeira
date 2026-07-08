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
      success: `${publicBaseUrl}/payment-success.html`,
      pending: `${publicBaseUrl}/payment-pending.html`,
      failure: `${publicBaseUrl}/payment-failure.html`
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
    validateMercadoPagoWebhook(req);

    const paymentId = getPaymentId(req);
    const client = getMercadoPagoClient();

    if (!paymentId || !client) {
      return res.status(200).json({ received: true });
    }

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    if (payment.status === 'approved') {
      await Subscription.markPaymentPaid({
        providerPaymentId: String(payment.id),
        providerPreferenceId: payment.external_reference,
        rawPayload: payment
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return res.status(401).json({ received: false });
    }

    return res.status(200).json({ received: true });
  }
}

module.exports = {
  status,
  renew,
  mercadoPagoWebhook
};
