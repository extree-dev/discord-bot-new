package tech.extree.stats;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class StatsBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(StatsBackendApplication.class, args);
    }
}