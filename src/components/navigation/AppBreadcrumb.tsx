import { useLocation, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export function AppBreadcrumb() {
  const location = useLocation();
  const path = location.pathname;

  let title = 'Home';
  let parentTitle = '';
  let parentPath = '';
  let grandparentTitle = '';
  let grandparentPath = '';

  if (path.startsWith('/busses')) {
    if (path === '/busses') {
      title = 'Busse';
      parentTitle = 'Stammdaten';
      parentPath = '/';
    } else if (path.includes('/new')) {
      title = 'Neuer Bus';
      parentTitle = 'Busse';
      parentPath = '/busses';
      grandparentTitle = 'Stammdaten';
      grandparentPath = '/';
    } else if (path.includes('/edit')) {
      title = 'Bus bearbeiten';
      parentTitle = 'Busse';
      parentPath = '/busses';
      grandparentTitle = 'Stammdaten';
      grandparentPath = '/';
    }
  } else if (path === '/lines') {
    title = 'Linien';
    parentTitle = 'Stammdaten';
    parentPath = '/';
  } else if (path === '/drivers') {
    title = 'Fahrer';
    parentTitle = 'Stammdaten';
    parentPath = '/';
  } else if (path.startsWith('/assignments')) {
    if (path.match(/\/assignments\/day\/[\d-]+/)) {
      const dateIso = path.split('/').pop();
      const formattedDate = dateIso ? new Date(dateIso).toLocaleDateString('de-DE') : '';
      title = `Zuweisung für den ${formattedDate}`;
      parentTitle = 'Zuweisungen';
      parentPath = '/';
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {grandparentTitle && (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink as={Link} to={grandparentPath}>
                {grandparentTitle}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        )}
        {parentTitle && (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink as={Link} to={parentPath}>
                {parentTitle}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}