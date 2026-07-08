const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      subscription_status: user.subscription_status,
      access_expires_at: user.access_expires_at
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res) {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha || senha.length < 6) {
      return res.status(400).json({ message: 'Informe nome, email e senha com pelo menos 6 caracteres.' });
    }

    const existingUser = await User.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Este email ja esta cadastrado.' });
    }

    const hash = await bcrypt.hash(senha, 12);
    const user = await User.createUser({ nome, email, senha: hash });

    return res.status(201).json({
      user,
      token: createToken(user)
    });
  } catch (error) {
    console.error('Erro ao cadastrar usuario:', error.message);
    return res.status(500).json({
      message: process.env.NODE_ENV === 'production'
        ? 'Erro ao cadastrar usuario.'
        : `Erro ao cadastrar usuario: ${error.message}`
    });
  }
}

async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: 'Informe email e senha.' });
    }

    const user = await User.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const passwordMatches = await bcrypt.compare(senha, user.senha);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const safeUser = {
      id: user.id,
      nome: user.nome,
      role: user.role,
      subscription_status: user.subscription_status,
      access_expires_at: user.access_expires_at,
      email: user.email
    };

    return res.json({
      user: safeUser,
      token: createToken(safeUser)
    });
  } catch (error) {
    console.error('Erro ao entrar:', error.message);
    return res.status(500).json({
      message: process.env.NODE_ENV === 'production'
        ? 'Erro ao entrar.'
        : `Erro ao entrar: ${error.message}`
    });
  }
}

async function me(req, res) {
  const user = await User.findUserById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'Usuario nao encontrado.' });
  }

  return res.json({ user });
}

module.exports = {
  register,
  login,
  me
};
