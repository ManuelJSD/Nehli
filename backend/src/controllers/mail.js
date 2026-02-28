const nodemailer = require('nodemailer');

/**
 * Función para enviar emails utilizando las credenciales SMTP
 * configuradas en las variables de entorno.
 */
const sendEmail = function (req, res) {
    // Definimos el transporter con variables de entorno
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT) || 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Definimos el email
    const mailOptions = {
        from: process.env.SMTP_FROM || 'no-reply@Nehli.com',
        to: req.body.to,
        subject: req.body.subject || 'Nehli',
        text: req.body.text || ''
    };

    // Enviamos el email
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.error("Error al enviar email:", error);
            res.status(500).json({ error: error.message });
        } else {
            console.log("Email enviado!");
            res.status(200).json({ message: "Email enviado correctamente." });
        }
    });
};

module.exports = sendEmail;
