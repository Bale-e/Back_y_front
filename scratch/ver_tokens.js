require('dotenv').config();
const { db } = require('../src/shared/infrastructure/firebase/firebaseAdmin');

async function listarTokens() {
  try {
    console.log('Consultando la colección "api_tokens" en Firestore...\n');
    const snapshot = await db.collection('api_tokens').get();

    if (snapshot.empty) {
      console.log('No se encontraron tokens registrados.');
      return;
    }

    console.log(`Se encontraron ${snapshot.docs.length} token(s) registrado(s):\n`);
    snapshot.docs.forEach((doc, index) => {
      console.log(`Token #${index + 1}:`);
      console.log(`  ID (Token):   ${doc.id}`);
      console.log(`  Activo:       ${doc.data().activo}`);
      console.log(`  Descripción:  ${doc.data().descripcion}`);
      console.log(`  Creado en:    ${doc.data().creadoEn}`);
      console.log('---------------------------------------------');
    });
  } catch (error) {
    console.error('Error al consultar Firestore:', error.message);
  }
}

listarTokens();
