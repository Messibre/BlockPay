(async () => {
  try {
    const r = await fetch('http://localhost:4000/api/v1/health');
    console.log('STATUS', r.status);
    const t = await r.text();
    console.log('BODY', t);
  } catch (e) {
    console.error('ERROR', e.message);
  }
})();
