require('dotenv').config();
const { db } = require('../src/shared/infrastructure/firebase/firebaseAdmin');

// Token de acceso que usará la aplicación
const TOKEN_VALOR = process.env.API_TOKEN || 'inago_api_token_2026_seguro';

async function registrarToken() {
  try {
    console.log('Conectando con Firestore...');
    const docRef = db.collection('api_tokens').doc(TOKEN_VALOR);

    await docRef.set({
      activo: true,
      descripcion: 'Token de acceso para solicitudes GET de InaGo',
      creadoEn: new Date().toISOString()
    });

    console.log('\n=============================================');
    console.log('✅ ¡Token registrado exitosamente en Firestore!');
    console.log(`Colección: api_tokens`);
    console.log(`Documento (Token): ${TOKEN_VALOR}`);
    console.log(`Estado: activo = true`);
    console.log('=============================================\n');
  } catch (error) {
    console.error('❌ Error al guardar el token en Firestore:', error.message);
  }
}

registrarToken();
