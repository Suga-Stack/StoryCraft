from django.core.management.base import BaseCommand
from django.conf import settings
from gameworks.models import Music
from tags.models import Tag
import os

class Command(BaseCommand):
    """python manage.py init_music"""

    help = '初始化背景音乐数据并关联标签，存储绝对URL'

    def handle(self, *args, **options):
        # 定义预置的音乐数据映射
        # filename: 相对于 media/music/ 的文件名
        music_data = [
            {
                "filename": "hype-drill-music-438398.mp3",
                "tags": ["科幻", "都市", "游戏", "轻松", "现代", "星际" ,"未来","赛博朋克","蒸汽朋克"]
            },
            {
                "filename": "soft-background-music-432715.mp3",
                "tags": ["仙侠", "科幻", "都市", "竞技","言情", "体育", "现实","种田","基建","轻松","治愈","搞笑","群像","日常","生活流","傲娇","病娇","萌宝","神豪","赘婿","现代","异界","异世界","星际","未来","民国","男频","女频","甜宠","霸总","校园","青春","耽美","百合","明星同人","二次元","轻小说","真人互动"]
            },
            {
                "filename": "background-music-159125.mp3",
                "tags": ["科幻", "都市", "游戏", "热血", "异世界","星际","赛博朋克","女频",]
            },
            {
                "filename": "groovy-vibe-427121.mp3",
                "tags": ["奇幻", "科幻", "都市", "游戏","轻松","异世界","未来","星际","赛博朋克",]
            },
            {
                "filename": "epic-cinematic-background-music-434442.mp3",
                "tags": ["军事", "历史", "竞技", "体育", "热血" ,"争霸","高武","洪荒"]
            },
            {
                "filename": "soft-corporate-background-music-441931.mp3",
                "tags": ["都市", "言情", "种田","基建","轻松","搞笑","治愈","日常","傲娇","萌宝","原始部落","原始社会","女频","甜宠","霸总","校园","青春","百合","二次元"]
            },
            {
                "filename": "vlog-beat-background-349853.mp3",
                "tags": ["军事", "竞技", "体育", "热血","争霸","高武","洪荒","蒸汽朋克"]
            },
            {
                "filename": "sad-documentary-background-music-365827.mp3",
                "tags": ["悬疑","灵异", "惊悚","暗黑","虐心","烧脑","西幻","宫斗","宅斗"]
            },
            {
                "filename": "motivation-motivational-music-392774.mp3",
                "tags": ["武侠","历史","虐心","烧脑","热血","权谋","洪荒","高武","悬疑"]
            },
            {
                "filename": "meditation-background-434654.mp3",
                "tags": ["玄幻","奇幻","异世界","星际","未来","原始部落","原始社会","轻小说"]
            },
            {
                "filename": "nostalgic-background-351782.mp3",
                "tags": ["悬疑","灵异","惊悚","末世","废土","异界","奇幻"]
            },
            {
                "filename": "meeting-the-stars-dramatic-cinematic-background-music-for-epic-video-197578.mp3",
                "tags": ["奇幻","游戏","竞技","热血"]
            },
            {
                "filename": "classic-documentary-piano-197603.mp3",
                "tags": ["玄幻","悬疑","灵异","惊悚","虐心","暗黑","权谋"]
            },
            {
                "filename": "golden-waves-432hz-219189.mp3",
                "tags": ["末世","废土","暗黑","虐心"]
            },
            {
                "filename": "powerful-energetic-sport-rock-trailer_ghost-rider-122077.mp3",
                "tags": ["军事","竞技","体育","无敌流","无限流","爽文","热血","争霸","克鲁苏","蒸汽朋克"]
            },
            {
                "filename": "coverless-book-lofi-186307.mp3",
                "tags": ["言情","轻松","治愈","都市","日常","生活流","现代","未来","西幻","女频","甜宠","霸总","百合"]
            },
            {
                "filename": "price-of-freedom-33106.mp3",
                "tags": ["历史","现实","末世","废土","暗黑","虐心","星际"]
            },
            {
                "filename": "amalgam-217007.mp3",
                "tags": ["科幻","都市","星际","赛博朋克","蒸汽朋克"]
            },
            {
                "filename": "night-street-relaxed-vlog-131746.mp3",
                "tags": ["都市","轻松","星际","赛博朋克","治愈","搞笑","未来","女频","甜宠","霸总"]
            },
            {
                "filename": "summer-walk-152722.mp3",
                "tags": ["种田","轻松","治愈","群像","日常","生活流","青春","校园"]
            }
        ]

        self.stdout.write("开始初始化背景音乐数据...")

        created_count = 0
        updated_count = 0

        for item in music_data:
            filename = item["filename"]
            tag_names = item["tags"]

            # 构造完整的绝对 URL
            # 例如: http://localhost:8000/media/music/adventure.mp3
            full_url = f"{settings.SITE_DOMAIN}{settings.MEDIA_URL}music/{filename}"
            
            # 检查物理文件是否存在（仅提示）
            full_path = os.path.join(settings.MEDIA_ROOT, 'music', filename)
            if not os.path.exists(full_path):
                self.stdout.write(self.style.WARNING(f"警告: 物理文件不存在 {full_path}，但仍将创建数据库记录。"))

            # 创建 or 获取 Music 对象 (以 URL 为准)
            music, created = Music.objects.get_or_create(
                url=full_url
            )
            
            # 关联标签
            tags_to_add = []
            for name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=name)
                tags_to_add.append(tag)
            
            music.tags.set(tags_to_add)
            
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(f"完成！新建: {created_count}, 更新: {updated_count}"))
