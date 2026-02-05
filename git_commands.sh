# Открой Git Bash в папке с проектом и выполни эти команды по очереди:

# 2. Добавляем все файлы в отслеживание
git add .

# 3. Делаем коммит (сохранение версии)
git commit -m "MaxVibeFilms: Initial commit with random logic"

# 4. Переименовываем ветку в main (стандарт github)
git branch -M main

# 5. Привязываем к удаленному репозиторию (который ты указал)
# Если репозиторий уже привязан, команда может выдать ошибку, это нормально - иди к шагу 6.
git remote add origin https://github.com/Reiven888/maxvibefilms.git

# Если на гитхабе УЖЕ был создан README или License и git push выдает ошибку,
# используй force push (осторожно, это перезапишет историю на сервере):
# git push -u origin main --force