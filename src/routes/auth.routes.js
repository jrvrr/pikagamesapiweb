const express = require('express');
const router = express.Router();
const { registrar, login, getMe, updateProfile, updatePassword, requestPasswordReset, resetPassword, googleLogin } = require('../controllers/auth.controller');
const auth = require('../middlewares/auth');

router.post('/registro', registrar);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/me', auth, getMe);
router.put('/perfil', auth, updateProfile);
router.put('/password', auth, updatePassword);

module.exports = router;
