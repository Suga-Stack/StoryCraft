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
