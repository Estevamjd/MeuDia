export function termosProibidos(env?: Record<string, string | undefined>): { rotulo: string; valor: string }[];
export function procurarVazamentos(dir: string, termos: { rotulo: string; valor: string }[]): { arquivo: string; rotulo: string }[];
