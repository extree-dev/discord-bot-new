package tech.extree.stats.application.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;

@Service
public class AvatarService {

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
        
        if (file.isEmpty() || file.getContentType() == null || !file.getContentType().startsWith("image/")) {
            return Optional.empty();
        }

        try {
            String extension = file.getOriginalFilename() != null && file.getOriginalFilename().contains(".") 
                ? file.getOriginalFilename().substring(file.getOriginalFilename().lastIndexOf(".")) 
                : ".png";
            String filename = UUID.randomUUID().toString() + extension;
            Path destinationFile = this.rootLocation.resolve(filename);
            Files.copy(file.getInputStream(), destinationFile);

            String avatarUrl = "/api/account/avatar/" + filename;
            userRepository.updateAvatar(session.get().userId(), avatarUrl);

            return Optional.of(avatarUrl);
        } catch (IOException e) {
            return Optional.empty();
        }
    }
}