-- AlterTable
ALTER TABLE `providercredential` MODIFY `provider` ENUM('DATAFORSEO', 'SERPER', 'BING', 'GOOGLE') NOT NULL;

-- AlterTable
ALTER TABLE `projectcredential` MODIFY `provider` ENUM('DATAFORSEO', 'SERPER', 'BING', 'GOOGLE') NOT NULL;
