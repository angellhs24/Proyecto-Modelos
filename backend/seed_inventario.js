const db = require('./src/config/db');

async function seed() {
  const [rows] = await db.pool.query('SELECT COUNT(*) AS total FROM Inventario');
  if (rows[0].total === 0) {
    console.log('Inserting seed items in Inventario...');
    await db.pool.query(`
      INSERT INTO Inventario (fk_clinica_id, nombre_articulo, categoria, cantidad_stock, unidad_medida, stock_minimo) VALUES 
      (1, 'Hojas de Bisturí #15 Estériles', 'Instrumental', 4, 'Caja 100pz', 10),
      (1, 'Gasas Estériles no Tejidas 10x10', 'Material de Curación', 3, 'Paquete 50pz', 15),
      (1, 'Solución Antiséptica Clorhexidina 2%', 'Medicamentos', 2, 'Frasco 500ml', 5),
      (1, 'Guantes de Nitrilo Grado Médico (M)', 'Desechables', 32, 'Caja 50 pares', 10),
      (1, 'Hojas de Gubia Podológica #1', 'Instrumental', 0, 'Caja 50pz', 8),
      (1, 'Apósitos Hidrocoloides para Úlceras', 'Material de Curación', 5, 'Caja 10pz', 5),
      (1, 'Silicio Ortopodológico Blando', 'Ortopodología', 14, 'Tarro 500g', 4),
      (1, 'Micoclor Tópico Antimicótico', 'Medicamentos', 20, 'Frasco gotero', 6),
      (1, 'Vendas Elásticas Cohesivas 5cm', 'Material de Curación', 2, 'Rollo', 8),
      (1, 'Campos Quirúrgicos Desechables Azules', 'Desechables', 45, 'Pieza', 20);
    `);
    console.log('✅ Seed items inserted successfully!');
  } else {
    console.log('Inventario already has data:', rows[0].total);
  }
  process.exit(0);
}

seed().catch(err => {
  console.error('Error seeding:', err);
  process.exit(1);
});
