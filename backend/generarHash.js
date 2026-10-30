
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';

const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});

try {
  const password = await terminal.question(
    'Escribe la contraseña inicial del administrador: '
  );

  const hash = await bcrypt.hash(password, 12);

  console.log('\nHash generado:\n');
  console.log(hash);
} finally {
  terminal.close();
}
