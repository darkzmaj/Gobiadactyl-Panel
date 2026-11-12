import { useLocation, useRouter } from '@tanstack/react-router';
import AdminTabs, { tabGroupFor } from '@/components/admin/AdminTabs';
import type { PageContentBlockProps } from '@/components/elements/PageContentBlock';
import PageContentBlock from '@/components/elements/PageContentBlock';
import PageHeading from '@/components/elements/PageHeading';

interface Props extends PageContentBlockProps {
    heading: string;
    description?: string;
}

/** Gobia: the heading of a tab group (Nodes & Instances, Eggs & Mounts, Settings) and its tabs above the page. */
const RoutedAdminContentBlock = ({ heading, description, children, ...props }: Props) => {
    const path = useLocation({ select: (location) => location.pathname });
    const group = tabGroupFor(path);

    return (
        <PageContentBlock {...props}>
            <PageHeading title={group?.heading ?? heading} description={description} />
            <AdminTabs />
            {children}
        </PageContentBlock>
    );
};

const AdminContentBlock = (props: Props) => {
    // Component specs render admin pages without a router; they get the plain upstream heading and no tabs.
    const router = useRouter({ warn: false });

    if (router) {
        return <RoutedAdminContentBlock {...props} />;
    }

    const { heading, description, children, ...rest } = props;

    return (
        <PageContentBlock {...rest}>
            <PageHeading title={heading} description={description} />
            {children}
        </PageContentBlock>
    );
};

export default AdminContentBlock;
