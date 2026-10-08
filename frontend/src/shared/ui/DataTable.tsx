import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SearchIcon, SortIcon } from './icons';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
    key: string;
    label: string;
    sortable?: boolean;
    sortValue?: (row: T) => string | number;
    render?: (row: T) => ReactNode;
    align?: 'left' | 'right' | 'center';
}

export interface DataTableFilter<T> {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    match: (row: T, value: string) => boolean;
}

interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    rows: T[];
    getRowId: (row: T) => string;
    searchPlaceholder?: string;
    searchKeys?: (row: T) => string[];
    filters?: DataTableFilter<T>[];
    pageSizeOptions?: number[];
    emptyMessage?: string;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50];

// Фильтрация/сортировка/пагинация — всё на клиенте: данные уже целиком
// загружены одним запросом (тот же подход, что у списков каналов/ролей —
// см. entities/guild-resources/), поэтому фильтр работает мгновенно по
// мере ввода, без отдельной кнопки "Найти" — в отличие от бэкенд-пагинации
// (как на референсе, присланном пользователем), здесь её ждать незачем.
export function DataTable<T>({
    columns,
    rows,
    getRowId,
    searchPlaceholder = 'Поиск',
    searchKeys,
    filters,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    emptyMessage = 'Ничего не найдено.',
}: DataTableProps<T>) {
    const [search, setSearch] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeOptions[0]);

    const filtered = useMemo(() => {
        let result = rows;
        const q = search.trim().toLowerCase();
        if (q && searchKeys) {
            result = result.filter(row => searchKeys(row).some(v => v?.toLowerCase().includes(q)));
        }
        if (filters) {
            for (const filter of filters) {
                const value = filterValues[filter.key];
                if (value) result = result.filter(row => filter.match(row, value));
            }
        }
        if (sort) {
            const column = columns.find(c => c.key === sort.key);
            const getValue = column?.sortValue;
            if (getValue) {
                result = [...result].sort((a, b) => {
                    const va = getValue(a);
                    const vb = getValue(b);
                    const cmp =
                        typeof va === 'number' && typeof vb === 'number'
                            ? va - vb
                            : String(va).localeCompare(String(vb));
                    return sort.dir === 'asc' ? cmp : -cmp;
                });
            }
        }
        return result;
    }, [rows, search, filterValues, filters, sort, columns, searchKeys]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    function toggleSort(key: string) {
        setSort(prev => {
            if (!prev || prev.key !== key) return { key, dir: 'asc' };
            if (prev.dir === 'asc') return { key, dir: 'desc' };
            return null;
        });
    }

    function resetAll() {
        setSearch('');
        setFilterValues({});
        setPage(1);
    }

    const pageNumbers = buildPageNumbers(safePage, pageCount);

    return (
        <div className={styles.wrap}>
            <div className={styles.toolbar}>
                <div className={styles.searchField}>
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                {filters?.map(filter => (
                    <select
                        key={filter.key}
                        className={styles.filterSelect}
                        value={filterValues[filter.key] ?? ''}
                        onChange={e => {
                            setFilterValues(v => ({ ...v, [filter.key]: e.target.value }));
                            setPage(1);
                        }}
                    >
                        <option value="">{filter.label}</option>
                        {filter.options.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ))}
                <button type="button" className={styles.clearButton} onClick={resetAll}>
                    Очистить
                </button>
            </div>

            <div className={styles.tableScroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={col.align === 'right' ? styles.alignRight : undefined}
                                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                                    data-sortable={col.sortable ? 'true' : undefined}
                                >
                                    <span className={styles.thInner}>
                                        {col.label}
                                        {col.sortable && (
                                            <span
                                                className={`${styles.sortIcon} ${sort?.key === col.key ? styles.sortIconActive : ''}`}
                                                data-dir={sort?.key === col.key ? sort.dir : undefined}
                                            >
                                                <SortIcon />
                                            </span>
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.length === 0 && (
                            <tr>
                                <td className={styles.empty} colSpan={columns.length}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                        {pageRows.map(row => (
                            <tr key={getRowId(row)}>
                                {columns.map(col => (
                                    <td key={col.key} className={col.align === 'right' ? styles.alignRight : undefined}>
                                        {col.render ? col.render(row) : null}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.footer}>
                <span className={styles.summary}>
                    {filtered.length === 0
                        ? 'Показано 0 из 0'
                        : `Показано ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} из ${filtered.length}`}
                </span>
                <div className={styles.footerRight}>
                    <label className={styles.pageSize}>
                        По
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            {pageSizeOptions.map(size => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                        на странице
                    </label>
                    <div className={styles.pager}>
                        <button type="button" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
                            ←
                        </button>
                        {pageNumbers.map((n, i) =>
                            n === null ? (
                                <span key={`ellipsis-${i}`} className={styles.ellipsis}>
                                    …
                                </span>
                            ) : (
                                <button
                                    key={n}
                                    type="button"
                                    className={n === safePage ? styles.pageActive : undefined}
                                    onClick={() => setPage(n)}
                                >
                                    {n}
                                </button>
                            )
                        )}
                        <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)}>
                            →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 1 … p-1 p p+1 … N — первая/последняя страница всегда видны, вокруг
// текущей — по одной соседней, остальное схлопывается в "…".
function buildPageNumbers(current: number, total: number): (number | null)[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...pages].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const result: (number | null)[] = [];
    let prev = 0;
    for (const n of sorted) {
        if (prev && n - prev > 1) result.push(null);
        result.push(n);
        prev = n;
    }
    return result;
}
