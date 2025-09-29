ALTER TABLE `lightfast_chat_message`
  ADD COLUMN `char_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `token_count` INT NULL;
