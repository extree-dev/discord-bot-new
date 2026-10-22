package tech.extree.stats.adapter.in.web.dto;

import java.util.List;

public record AdminUserResponse(List<AdminUser> users) {
    public record AdminUser(
            String id,
            String email,
            String name,
            String nickname,
            String avatarUrl,
            boolean isVerified,
            boolean isBanned,
            boolean isAdmin
    ) {}
}