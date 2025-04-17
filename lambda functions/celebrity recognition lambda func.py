import boto3
import json
import base64
import logging
from typing import Dict, Any, List

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
rekognition_client = boto3.client('rekognition')


def generate_response(body: Dict[str, Any], status_code: int = 200) -> Dict[str, Any]:
    """Generate standardized API response with CORS headers."""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps(body)
    }


def handle_preflight_request() -> Dict[str, Any]:
    """Handle CORS preflight OPTIONS request."""
    return generate_response({}, 200)


def process_image_upload(image_data: str, bucket_name: str, request_id: str, order: int) -> str:
    """Upload image to S3 and return object key."""
    file_key = f"url-path/{request_id}-{order}.json"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=file_key,
        Body=image_data,
        ContentType='application/json'
    )
    logger.info("inforoush - file_key: %s", file_key)
    return file_key


def crawl_images(url, max_images=9, bucket_name=None, context=None):
    """Crawl webpage and return dictionary of {image_url: image_bytes}"""
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
            img_url = image_urls[i:i + 3]
            logger.info("inforoush - img_url: %s", img_url)
            file_key = process_image_upload(json.dumps(img_url), bucket_name, context.aws_request_id, i // 3)

    except Exception as e:
        print(f"Error crawling {url}: {str(e)}")
        return {}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda function handler."""
    try:
        logger.info("Incoming request: %s", json.dumps(event))

        bucket_name = "bucket-name"

        # # Handle CORS preflight
        # if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        #     return handle_preflight_request()

        # Parse request body
        body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']

        if not body.get('url'):
            raise ValueError("URL data is required in the request body")

        # Process the URL
        target_url = body['image']
        crawl_images(target_url, context=context, bucket_name=bucket_name)

    except ValueError as ve:
        logger.warning("Validation error: %s", str(ve))
        return generate_response({'error': str(ve)}, 400)
    except Exception as e:
        logger.error("Processing error: %s", str(e))
        return generate_response({'error': 'Internal server error'}, 500)