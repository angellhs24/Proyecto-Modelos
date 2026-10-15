const db = require('./src/config/db');

async function seedConsultasPendientes() {
  // Asegurarnos de que existan pacientes y consultas atendidas listas para cobrar
  const [pacientes] = await db.pool.query('SELECT No_expediente FROM Pacientes LIMIT 5');
  console.log('Pacientes existentes:', pacientes.length);

  // Consultas de prueba atendidas
  const consultasMock = [
    {
      id: 'CNS-001',
      exp: 2026101101,
      fecha: '2026-10-15 09:30:00',
      estado: 'Atendida',
      motivo: 'Quiropodia Preventiva & Corte Clínico Especializado'
    },
    {
      id: 'CNS-102',
      exp: 2026010001,
      fecha: '2026-10-15 10:15:00',
      estado: 'Atendida',
      motivo: 'Tratamiento de Onicocriptosis (Uña encarnada pie derecho)'
    },
    {
      id: 'CNS-103',
      exp: 2026010002,
      fecha: '2026-10-15 11:00:00',
      estado: 'Finalizada',
      motivo: 'Desbridamiento de heloma plantar y pulido ungueal'
    },
    {
      id: 'CNS-104',
      exp: 2026010003,
      fecha: '2026-10-15 11:45:00',
      estado: 'Atendida',
      motivo: 'Curación de ampolla por fricción y descarga ortopodológica'
    }
  ];

  for (const c of consultasMock) {
    await db.pool.query(`
      INSERT INTO Consultas (Consulta_id, fk_no_expediente, fk_clinica_id, fk_cedula_podologo, fecha_hora, estado, motivo_o_notas)
      VALUES (?, ?, 1, 'CED12345678', ?, ?, ?)
      ON DUPLICATE KEY UPDATE estado = VALUES(estado), motivo_o_notas = VALUES(motivo_o_notas)
    `, [c.id, c.exp, c.fecha, c.estado, c.motivo]);

    // Asegurarnos de que no tengan pago o que su pago esté Pendiente
    const [pagoExistente] = await db.pool.query('SELECT Pago_id, estado_pago FROM Pagos WHERE fk_consulta_id = ?', [c.id]);
    if (pagoExistente.length === 0) {
      const pagoId = `PAG-PEND-${c.id}`;
      await db.pool.query(`
        INSERT INTO Pagos (Pago_id, fk_consulta_id, fk_recepcionista_id, monto, metodo_pago, estado_pago, fecha_pago)
        VALUES (?, ?, 1, 450.00, 'Pendiente', 'Pendiente', NOW())
        ON DUPLICATE KEY UPDATE estado_pago = 'Pendiente'
      `, [pagoId, c.id]);
    }
  }

  console.log('✅ Consultas atendidas y pagos pendientes preparados para el módulo de caja.');
  process.exit(0);
}

seedConsultasPendientes().catch(err => {
  console.error(err);
  process.exit(1);
});
