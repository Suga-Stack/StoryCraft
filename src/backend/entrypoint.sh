#!/bin/sh

if [ "$DATABASE" = "mysql" ]
then
    echo "Waiting for mysql..."

    while ! nc -z $DB_HOST $DB_PORT; do
      sleep 0.1
    done

    echo "MySQL started"
fi

# 执行数据库迁移
python manage.py makemigrations
python manage.py migrate
python manage.py loaddata tags/fixtures/initial_tags.json
python manage.py init_music
# 收集静态文件
python manage.py collectstatic --no-input

# 启动 Gunicorn
exec "$@"
