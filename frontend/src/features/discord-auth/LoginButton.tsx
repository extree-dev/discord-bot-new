import { Button } from '../../shared/ui/Button';

export function LoginButton() {
    return (
        <Button href="/auth/discord/login" variant="primary" fullWidth>
            Войти через Discord
        </Button>
    );
}
