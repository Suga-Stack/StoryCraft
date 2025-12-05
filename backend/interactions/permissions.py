from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    只有对象所有者可以修改/删除；其它用户只能读。
    """

    def has_object_permission(self, request, view, obj):
        # 允许安全方法
        if request.method in permissions.SAFE_METHODS:
            return True

        if request.user.is_staff:
            return True

        # 检查属性
        owner = getattr(obj, 'author', None)
        if owner is None:
            # 若对象没有 user，拒绝写权限
            return False
        return owner == request.user
