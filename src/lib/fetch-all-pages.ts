const DEFAULT_PAGE_SIZE = 1000;

type PagedQuery<T> = {
  range: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>;
};

export async function fetchAllPages<T>(buildQuery: () => PagedQuery<T>, pageSize = DEFAULT_PAGE_SIZE): Promise<T[]> {
  const all: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message ?? "Erro ao carregar todos os registros.");
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
  }

  return all;
}