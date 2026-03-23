export function health(_req, res) {
  res.status(200).json({
    ok: true,
    service: 'backend',
    timestamp: new Date().toISOString(),
  });
}

export function apiInfo(_req, res) {
  res.status(200).json({
    message: 'Cocolytics backend API is running.',
    docs: '/api/health',
  });
}
