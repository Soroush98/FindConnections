import json

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
# import boto3

# s3_client = boto3.client('s3')

def get_image_bytes(image_url):
    """Fetch image and return base64 decoded bytes (Rekognition-compatible format)"""
    try:
        response = requests.get(image_url, stream=True)
        response.raise_for_status()

        # Get the raw bytes
        image_bytes = response.content

        # For debugging - compare with your working version
        print(f"Raw image size: {len(image_bytes)} bytes")
        print(f"First 100 bytes: {image_bytes[:100]}...")

        return image_bytes  # Already in correct format for Rekognition

    except Exception as e:
        print(f"Failed to fetch {image_url}: {str(e)}")
        return None


def crawl_images(url, max_images=5):
    """Crawl webpage and return images in Rekognition-compatible format"""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        image_urls = []

        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src:
                if not src.startswith(('http://', 'https://')):
                    src = urljoin(url, src)
                image_urls.append(src)

        images_data = {}
        for img_url in image_urls[:max_images]:
            print(f"\nProcessing: {img_url}")
            image_bytes = get_image_bytes(img_url)
            if image_bytes:
                images_data[img_url] = image_bytes
                # Verify the bytes look like your working example
                print(f"Image bytes type: {type(image_bytes)}")
                print(f"Byte length: {len(image_bytes)}")

        return images_data

    except Exception as e:
        print(f"Error crawling {url}: {str(e)}")
        return {}

def process_image_upload(image_data: str, bucket_name: str, request_id: str, order:int) -> str:
    """Upload image to S3 and return object key."""
    file_key = f"image-urls/{request_id}-{order}.json"
    # s3_client.put_object(
    #     Bucket=bucket_name,
    #     Key=file_key,
    #     Body=image_data,
    #     ContentType='application/json'
    # )
    return file_key


def new_crawl_images(url, max_images=9, bucket_name='findconnections-urls', context=None):
    """Crawl webpage and return images in Rekognition-compatible format"""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        image_urls = []

        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src:
                if not src.startswith(('http://', 'https://')):
                    src = urljoin(url, src)
                if src.endswith(('.jpg', '.png', '.jpeg')):
                    image_urls.append(src)

        for i in range(0, max_images, 3):

            img_url = image_urls[i:i+3]
            print(img_url)
            # file_key = process_image_upload(json.dumps(image_urls), bucket_name, context.aws_request_id)
            file_key = process_image_upload(json.dumps(img_url), bucket_name, context, order=i//3)

    except Exception as e:
        print(f"Error crawling {url}: {str(e)}")
        return {}


# Example usage for AWS Rekognition
if __name__ == '__main__':
    target_url = "https://www.imdb.com/gallery/rg403872512/?ref_=mv_close"
    # images_dict = crawl_images(target_url)
    images_dict = new_crawl_images(target_url, context='salam')

    # if images_dict:
    #     # Example of preparing for Rekognition
    #     first_url, image_bytes = next(iter(images_dict.items()))
    #
    #     # This is how you would use it with AWS Rekognition
    #     rekognition = boto3.client('rekognition')
    #     response = rekognition.recognize_celebrities(
    #         Image={'Bytes': image_bytes}  # Directly use the bytes
    #     )
    #
    #     print("Celebrity recognition results:")
    #     for celeb in response['CelebrityFaces']:
    #         print(f"- {celeb['Name']} (Confidence: {celeb['MatchConfidence']}%)")
