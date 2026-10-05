import { Button } from '../../shared/ui/Button';

interface LogoutButtonProps {
    fullWidth?: boolean;
}

export function LogoutButton({ fullWidth = true }: LogoutButtonProps) {
    return (
        <Button href="/auth/logout" variant="ghost" fullWidth={fullWidth}>
            Выйти
        </Button>
    );
}
