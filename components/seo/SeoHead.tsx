import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

export const SITE_ORIGIN = 'https://factcheckerai.info';

const OG_IMAGE = `${SITE_ORIGIN}/share-template.png`;

type SeoMeta = {
  title: string;
  description: string;
  noindex?: boolean;
};

const HOME: SeoMeta = {
  title: 'FACTCHECKER AI | Одит на Истинността',
  description:
    'DEEP CONTEXTUAL GENERATIVE ENGINE (DCGE) — професионален фактчекинг и анализ на видеа, статии и медийно съдържание.'
};

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

/** Per-path SEO; used by desktop and mobile shells. */
export function resolveRouteSeo(pathname: string): SeoMeta {
  const path = normalizePath(pathname);

  if (path.startsWith('/admin') || path === '/chat-admin') {
    return {
      title: 'Администрация | FACTCHECKER AI',
      description: 'Административен панел.',
      noindex: true
    };
  }

  if (
    path === '/login' ||
    path === '/register' ||
    path === '/expenses' ||
    path === '/archive'
  ) {
    const labels: Record<string, string> = {
      '/login': 'Вход',
      '/register': 'Регистрация',
      '/expenses': 'Разходи',
      '/archive': 'Архив'
    };
    return {
      title: `${labels[path]} | FACTCHECKER AI`,
      description: 'Потребителска зона на FACTCHECKER AI.',
      noindex: true
    };
  }

  if (path === '/pricing') {
    return {
      title: 'Цени и точки | FACTCHECKER AI',
      description:
        'Планове, точки и плащания за DCGE анализ — видео, статии и дълбок мултимодален одит.'
    };
  }

  if (path === '/terms') {
    return {
      title: 'Общи условия | FACTCHECKER AI',
      description: 'Общи условия за ползване на FACTCHECKER AI и услугите DCGE.'
    };
  }

  if (path === '/privacy') {
    return {
      title: 'Политика за поверителност | FACTCHECKER AI',
      description: 'Как обработваме лични данни и бисквитки в FACTCHECKER AI.'
    };
  }

  if (path === '/refund-policy') {
    return {
      title: 'Политика за възстановяване | FACTCHECKER AI',
      description: 'Условия за възстановяване на суми и точки в FACTCHECKER AI.'
    };
  }

  if (path === '/audit') {
    return {
      title: 'Одит на съдържание | FACTCHECKER AI',
      description: 'Стартирайте DCGE одит на видео или статия от мобилния интерфейс.'
    };
  }

  if (path === '/profile') {
    return {
      title: 'Профил | FACTCHECKER AI',
      description: 'Профил и настройки в FACTCHECKER AI.'
    };
  }

  if (path === '/analysis-result') {
    return {
      title: 'Резултат от анализ | FACTCHECKER AI',
      description: 'Преглед на DCGE анализ — фактчек, манипулации и обобщение.'
    };
  }

  if (/^\/report\/[^/]+$/.test(path)) {
    return {
      title: 'Споделен доклад | FACTCHECKER AI',
      description: 'Публичен или личен DCGE доклад — фактчек и мултимодален анализ.'
    };
  }

  if (path === '/') {
    return HOME;
  }

  return {
    title: 'FACTCHECKER AI',
    description: HOME.description
  };
}

const SeoHead: React.FC = () => {
  const { pathname } = useLocation();
  const meta = resolveRouteSeo(pathname);
  const canonicalPath = pathname === '' ? '/' : pathname;
  const canonical = `${SITE_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`;

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      {meta.noindex ? (
        <meta name="robots" content="noindex, follow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
};

export default SeoHead;
