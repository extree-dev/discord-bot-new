import { Button } from '../../shared/ui/Button';

export function LogoutButton() {
    return (
        <Button href="/auth/logout" variant="ghost" fullWidth>
            Выйти
        </Button>
    );
}
