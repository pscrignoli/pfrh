/**
 * Checks if an employee holds a director-level position based on their job title.
 * Used to determine if salary data should be protected/hidden.
 * 
 * Matches: Diretor, Diretora, CEO, Presidente
 * Does NOT match: Coordenador, Gerente, Responsável Técnico, Secretária, etc.
 */
export function isDiretor(employee: { cargo?: string | null }): boolean {
  if (!employee.cargo) return false;
  const cargoLower = employee.cargo.toLowerCase();
  return (
    cargoLower.includes('diretor') ||
    cargoLower.includes('ceo') ||
    cargoLower.includes('presidente')
  );
}
