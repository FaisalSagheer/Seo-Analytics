-- A project can store a Gemini API key next to its Google service account
ALTER TABLE `providercredential` MODIFY `provider` ENUM('DATAFORSEO', 'SERPER', 'BING', 'GOOGLE', 'GEMINI') NOT NULL;
ALTER TABLE `projectcredential` MODIFY `provider` ENUM('DATAFORSEO', 'SERPER', 'BING', 'GOOGLE', 'GEMINI') NOT NULL;
