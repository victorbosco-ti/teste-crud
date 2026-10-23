export async function request(path = '', options = {}) {
  let response;
  try {
    response = await fetch(`/api/users${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique sua conexão e tente novamente.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || (data?.errors && Object.values(data.errors).flat().join(' '));
    throw new Error(message || 'Não foi possível concluir a operação. Tente novamente.');
  }
  if (data === null) throw new Error('Resposta inesperada da API. Verifique a configuração do servidor.');
  return data;
}
