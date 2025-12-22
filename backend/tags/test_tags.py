from tags.models import Tag
from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class TagViewSetTestCase(APITestCase):
    """
    Test suite for the TagViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.tag1 = Tag.objects.create(name="Tag1")
        self.tag2 = Tag.objects.create(name="Tag2")
        self.url_list = reverse('tag-list')
        self.url_detail = lambda pk: reverse('tag-detail', kwargs={'pk': pk})
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.client.force_authenticate(user=self.user)

    def test_list_tags(self):
        """
        Test retrieving a list of tags.
        """
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]['name'], self.tag1.name)
        self.assertEqual(response.data["results"][1]['name'], self.tag2.name)

    def test_retrieve_tag(self):
        """
        Test retrieving a single tag by ID.
        """
        response = self.client.get(self.url_detail(self.tag1.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.tag1.name)

    def test_create_tag(self):
        """
        Test creating a new tag.
        """
        data = {"name": "NewTag"}
        response = self.client.post(self.url_list, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], data['name'])
        self.assertTrue(Tag.objects.filter(name="NewTag").exists())

    def test_update_tag(self):
        """
        Test updating an existing tag.
        """
        data = {"name": "UpdatedTag"}
        response = self.client.put(self.url_detail(self.tag1.id), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tag1.refresh_from_db()
        self.assertEqual(self.tag1.name, "UpdatedTag")

    def test_partial_update_tag(self):
        """
        Test partially updating an existing tag.
        """
        data = {"name": "PartiallyUpdatedTag"}
        response = self.client.patch(self.url_detail(self.tag1.id), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tag1.refresh_from_db()
        self.assertEqual(self.tag1.name, "PartiallyUpdatedTag")

    def test_delete_tag(self):
        """
        Test deleting an existing tag.
        """
        response = self.client.delete(self.url_detail(self.tag1.id))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Tag.objects.filter(id=self.tag1.id).exists())