
const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

// Explicitly load .env from the backend directory
const envPath = path.resolve(__dirname, 'backend', '.env');
const result = dotenv.config({ path: envPath });

console.log('Loading .env from:', envPath);

if (result.error) {
    console.error('❌ Error loading .env file:', result.error);
} else {
    console.log('✅ .env file loaded successfully');
}

console.log('Environment Variables Check:');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_FROM:', process.env.SMTP_FROM);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function diagnose() {
    try {
        const info = await transporter.verify();
        console.log('✅ SMTP Connection verified:', info);

        console.log('Attempting to send test email...');
        const result = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: 'fita.softimad@gmail.com',
            subject: 'Diagnosis Test Email',
            text: 'This is a diagnosis email to verify configuration.'
        });
        console.log('✅ Email sent:', result.messageId);
    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    }
}

diagnose();
