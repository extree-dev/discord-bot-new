import { SignInPage } from '../pages/sign-in';

// Пока единственная страница — React Router не подключаем заранее
// (YAGNI): как только появятся /dashboard или другие страницы продукта,
// App.tsx перейдёт на тот же паттерн <Routes>/<Route>, что и в frontend/
// src/app/App.tsx.
export function App() {
    return <SignInPage />;
}
