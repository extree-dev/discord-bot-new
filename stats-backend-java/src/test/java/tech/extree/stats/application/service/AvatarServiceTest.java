package tech.extree.stats.application.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.LoginSession;

class AvatarServiceTest {

    @Test
    void uploadAvatarReEncodesInsteadOfWritingRawBytesStrippingTrailingMetadata() throws IOException {
        UserRepository userRepository = mock(UserRepository.class);
        SessionRepository sessionRepository = mock(SessionRepository.class);
        when(sessionRepository.validate("cookie")).thenReturn(Optional.of(new LoginSession("session-id", null, "user-id", 0L)));

        AvatarService service = new AvatarService(userRepository, sessionRepository);

        // Настоящий PNG 4x4 + "хвост" после конца изображения — то место,
        // где в реальном файле может лежать EXIF/прочие метаданные, которые
        // декодер игнорирует, но которые раньше попадали на диск, потому
        // что сервис писал исходные байты как есть.
        BufferedImage source = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream pngBytes = new ByteArrayOutputStream();
        ImageIO.write(source, "png", pngBytes);
        byte[] marker = "TRAILING-METADATA-SHOULD-NOT-SURVIVE".getBytes(StandardCharsets.UTF_8);
        byte[] withTrailer = new byte[pngBytes.size() + marker.length];
        System.arraycopy(pngBytes.toByteArray(), 0, withTrailer, 0, pngBytes.size());
        System.arraycopy(marker, 0, withTrailer, pngBytes.size(), marker.length);

        MockMultipartFile file = new MockMultipartFile("avatar", "avatar.png", "image/png", withTrailer);

        Optional<String> avatarUrl = service.uploadAvatar("cookie", file);

        assertTrue(avatarUrl.isPresent());
        String filename = avatarUrl.get().substring(avatarUrl.get().lastIndexOf('/') + 1);
        Path stored = Path.of("uploads/avatars", filename);
        assertTrue(Files.exists(stored));

        byte[] storedBytes = Files.readAllBytes(stored);
        String storedAsText = new String(storedBytes, StandardCharsets.ISO_8859_1);
        assertFalse(storedAsText.contains("TRAILING-METADATA-SHOULD-NOT-SURVIVE"));

        BufferedImage decoded = ImageIO.read(stored.toFile());
        assertTrue(decoded != null && decoded.getWidth() == 4 && decoded.getHeight() == 4);

        Files.deleteIfExists(stored);
    }
}
