const express = require('express');
const router = express.Router();
const { registrar, login, getMe, updateProfile, updatePassword } = require('../controllers/auth.controller');
const auth = require('../middlewares/auth');

router.post('/registro', registrar);
router.post('/login', login);
router.get('/me', auth, getMe);
router.put('/perfil', auth, updateProfile);
router.put('/password', auth, updatePassword);

module.exports = router;
