package tech.extree.stats.application.service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;

@Service
public class AvatarService {

    // Только настоящие растровые форматы — ни SVG (может содержать
    // <script>, рендерится как XML при прямом переходе по ссылке), ни что
    // либо ещё. Content-Type и расширение из запроса — это то, что
    // ПРОВЕРЯЕТСЯ, а не то, чему доверяем: реальный формат определяется
    // ниже декодированием байтов через ImageIO.
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");

    private final UserRepository userRepository;
    private final SessionCodec sessionCodec;
    private final Path rootLocation = Paths.get("uploads/avatars");

    public AvatarService(UserRepository userRepository, SessionCodec sessionCodec) {
        this.userRepository = userRepository;
        this.sessionCodec = sessionCodec;
        try {
            Files.createDirectories(rootLocation); // Создаем папку при старте
        } catch (IOException e) {
            throw new RuntimeException("Не удалось создать директорию для аватарок", e);
        }
    }

    public Optional<String> uploadAvatar(String cookieValue, MultipartFile file) {
        if (cookieValue == null) return Optional.empty();
        Optional<Session> session = sessionCodec.decrypt(cookieValue);
        if (session.isEmpty() || session.get().userId() == null) return Optional.empty();

        if (file.isEmpty()) return Optional.empty();

        String extension = extractExtension(file.getOriginalFilename());
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)) {
            return Optional.empty();
        }

        try {
            byte[] bytes = file.getBytes();
            // Декодируем байты как изображение независимо от того, что
            // заявляют Content-Type/расширение — если ImageIO не узнаёт в
            // них настоящую картинку (например, это SVG или HTML с
            // Content-Type: image/*), файл отбраковываем здесь, а не
            // отдаём его дальше как есть.
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) {
                return Optional.empty();
            }

            String filename = UUID.randomUUID() + "." + extension;
            Path destinationFile = this.rootLocation.resolve(filename);

            // Пишем на диск не исходные байты, а то, что ImageIO только что
            // декодировал — это заодно убирает EXIF/метаданные (включая GPS,
            // если камера их записала в фото) и гарантирует, что на диске
            // лежит ровно то изображение, которое прошло проверку выше, а
            // не произвольные байты, которые лишь прикидывались картинкой.
            if (!writeImage(image, extension, destinationFile)) {
                return Optional.empty();
            }

            String avatarUrl = "/api/account/avatar/" + filename;
            userRepository.updateAvatar(session.get().userId(), avatarUrl);

            return Optional.of(avatarUrl);
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    /** jpg/jpeg не поддерживает альфа-канал — ImageIO.write иначе падает с
     * IIOException на картинке с прозрачностью (например, PNG, сохранённый
     * под .jpg расширением); в этом случае сначала убираем альфу на белом
     * фоне. */
    private static boolean writeImage(BufferedImage image, String extension, Path destination) throws IOException {
        String formatName = "jpg".equals(extension) ? "jpeg" : extension;
        BufferedImage toWrite = image;
        if ("jpeg".equals(formatName) && image.getColorModel().hasAlpha()) {
            toWrite = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = toWrite.createGraphics();
            try {
                g.drawImage(image, 0, 0, Color.WHITE, null);
            } finally {
                g.dispose();
            }
        }
        return ImageIO.write(toWrite, formatName, destination.toFile());
    }

    private static String extractExtension(String originalFilename) {
        if (originalFilename == null) return null;
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) return null;
        return originalFilename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}