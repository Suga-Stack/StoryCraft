from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from gameworks.models import Gamework
from stories.models import Story, StoryChapter
from tags.models import Tag
import random

User = get_user_model()

class Command(BaseCommand):
    help = '生成性能测试用的模拟数据'

    def add_arguments(self, parser):
        parser.add_argument('--users', type=int, default=10, help='创建用户数量')
        parser.add_argument('--games', type=int, default=50, help='创建作品数量')

    def handle(self, *args, **options):
        user_count = options['users']
        game_count = options['games']

        self.stdout.write('正在创建用户...')
        users = []
        for i in range(user_count):
            username = f'perf_user_{i}'
            email = f'perf_{i}@example.com'
            if not User.objects.filter(username=username).exists():
                user = User.objects.create_user(username=username, email=email, password='password123')
                users.append(user)
            else:
                users.append(User.objects.get(username=username))

        self.stdout.write('正在初始化标签...')
        tags = [ "奇幻", "科幻", "仙侠", "悬疑", "惊悚", "武侠", "历史"]
        tag_objs = []
        for t in tags:
            tag, _ = Tag.objects.get_or_create(name=t)
            tag_objs.append(tag)

        self.stdout.write('正在创建作品及章节...')
        for i in range(game_count):
            author = random.choice(users)
            gw = Gamework.objects.create(
                author=author,
                title=f'测试作品 {i}',
                description=f'这是一个用于测试的自动生成作品描述 {i}。包含大量文本以测试负载。',
                is_published=True, # 设为已发布，以便列表接口能查到
                image_url="http://82.157.231.8:8001/media/placeholders/cover.jpg"
            )
            gw.tags.set(random.sample(tag_objs, k=random.randint(1, 3)))
            
            # 创建 Story
            story = Story.objects.create(
                gamework=gw,
                total_chapters=5,
                initial_generation_complete=True,
                is_complete=True,
                ai_callable=False
            )
            
            # 创建 5 个章节
            for c in range(1, 6):
                # 生成较长的 parsed_content
                scenes = []
                for s_idx in range(1, 4): # 每个章节 3 个场景
                    dialogues = []
                    for d_idx in range(1, 16): # 每个场景 15 段对话
                        dialogues.append({
                            "narration": f"这是第 {c} 章第 {s_idx} 场景的第 {d_idx} 段旁白文本。这里包含一些测试用的长文本内容，用于模拟真实的游戏剧情体验。" * 2
                        })
                    
                    scenes.append({
                        "id": s_idx,
                        "dialogues": dialogues,
                        "background_image_url": "http://82.157.231.8:8001/media/placeholders/scene.jpg" 
                    })

                StoryChapter.objects.create(
                    story=story,
                    chapter_index=c,
                    title=f"第 {c} 章",
                    status=StoryChapter.ChapterStatus.GENERATED,
                    raw_content=f"这是第 {c} 章的原始内容..." * 100, 
                    parsed_content={
                        "title": f"第 {c} 章",
                        "scenes": scenes
                    }
                )

        self.stdout.write(self.style.SUCCESS(f'成功生成 {user_count} 个用户和 {game_count} 个作品。'))
