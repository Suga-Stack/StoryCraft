from .models import CreditLog

def change_user_credits(user, amount, log_type, remark=None):
    """
    修改用户积分并记录流水
    :param user: User 对象
    :param amount: 积分变动值（正数=增加，负数=减少）
    :param log_type: 流水类型
    :param remark: 备注
    """
    before = user.user_credits or 0
    after = before + amount

    user.user_credits = after
    user.save()

    CreditLog.objects.create(
        user=user,
        change_amount=amount,
        before_balance=before,
        after_balance=after,
        type=log_type,
        remark=remark
    )

    return after

def get_signin_reward(day: int):
    """根据连续签到天数返回奖励积分。第8天循环回第1天。"""
    cycle_day = (day - 1) % 7 + 1  # 1~7 循环

    reward_map = {
        1: 5,
        2: 10,
        3: 15,
        4: 20,
        5: 25,
        6: 30,
        7: 50,  # 连续奖励
    }
    return reward_map[cycle_day]
