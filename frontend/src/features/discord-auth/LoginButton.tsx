import { Button } from '../../shared/ui/Button';

interface LoginButtonProps {
    label?: string;
}

export function LoginButton({ label = 'Войти через Discord' }: LoginButtonProps) {
    return (
        <Button href="/auth/discord/login" variant="primary" fullWidth>
            {label}
        </Button>
    );
}
