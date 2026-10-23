import { test, expect } from '@playwright/test';

test('cadastro, detalhe, edição, filtro e exclusão pela interface', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;
  let userId;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
    await page.getByLabel('Nome completo').fill('Ana Teste');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Salvar usuário' }).click();
    await expect(page.getByRole('status')).toHaveText('Usuário cadastrado com sucesso.');
    const list = await (await request.get('/api/users')).json();
    userId = list.find(user => user.email === email).id;
    await page.getByLabel('Buscar usuários').fill(email);
    await page.getByRole('button', { name: 'Ver Ana Teste', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(email);
    await page.getByRole('button', { name: 'Editar usuário', exact: true }).click();
    await page.getByLabel('Nome completo').fill('Ana Editada');
    await page.getByLabel('Usuário ativo').uncheck();
    await page.getByRole('button', { name: 'Salvar usuário' }).click();
    await expect(page.getByRole('status')).toHaveText('Usuário atualizado com sucesso.');
    await page.reload();
    await page.getByLabel('Buscar usuários').fill(email);
    await expect(page.getByRole('row').filter({ hasText: email })).toContainText('Ana Editada');
    await page.getByLabel('Filtrar por status').selectOption('active');
    await expect(page.getByText('Nenhum resultado encontrado')).toBeVisible();
    await page.getByLabel('Filtrar por status').selectOption('inactive');
    await expect(page.getByRole('row').filter({ hasText: email })).toContainText('Inativo');
    await page.screenshot({ path: '../.local/desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Excluir Ana Editada', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
    await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
    await page.getByLabel('Nome completo').fill('Nome duplicado');
    await page.getByLabel('E-mail', { exact: true }).fill(email.toUpperCase());
    await page.getByRole('button', { name: 'Salvar usuário' }).click();
    await expect(page.getByRole('alert')).toHaveText('Já existe um usuário com este e-mail.');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Excluir Ana Editada', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
    await expect(page.getByRole('status')).toHaveText('Usuário excluído com sucesso.');
    await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
  } finally { if (userId) await request.delete(`/api/users/${userId}`); }
});

test('layout móvel e recuperação de falha da API', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/users', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar');
  await page.unroute('**/api/users');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Diretório de usuários' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../.local/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nome completo')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
