# Иконки ролей

`gender-male.png` / `gender-female.png` — иконки гендерных ролей (♂/♀), выдаваемых при верификации (см. `scripts/setup-verification.js`, `security/verification.js`).

Источник — [microsoft/fluentui-emoji](https://github.com/microsoft/fluentui-emoji), набор "3D", эмодзи "Male sign"/"Female sign". Лицензия — MIT, использование/модификация/распространение разрешены.

Подключаются как иконка роли (`guild.roles.create({ icon })`) — это не картинка в самом имени роли (имя у Discord всегда только текст), а отдельный значок рядом с именем, доступный только серверам с правом `ROLE_ICONS` (буст уровня 2+). На серверах без этого права роли создаются без иконки — только с именем-символом.
