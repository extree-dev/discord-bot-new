import { Button } from '../../shared/ui/Button';

interface LogoutButtonProps {
    fullWidth?: boolean;
    label?: string;
}

export function LogoutButton({ fullWidth = true, label = 'Выйти' }: LogoutButtonProps) {
    return (
        <Button href="/auth/logout" variant="ghost" fullWidth={fullWidth}>
            {label}
        </Button>
    );
}
