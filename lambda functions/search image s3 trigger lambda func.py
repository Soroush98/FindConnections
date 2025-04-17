import json
import boto3
import logging
from typing import Dict, Any, List
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
rekognition_client = boto3.client('rekognition')

def get_image_bytes(image_url):
    """Fetch image bytes from URL"""
    try:
        response = requests.get(image_url, stream=True)
        response.raise_for_status()
        logger.info(f"sori - image downloaded.")
        return response.content  # Returns image as bytes
    except Exception as e:
        print(f"Failed to fetch {image_url}: {str(e)}")
        return None

def detect_celebrities(image: bytes) -> List[Dict[str, Any]]:
    """Use Rekognition to identify celebrities in the image."""
    response = rekognition_client.recognize_celebrities(
        Image={'Bytes': image}
    )
    logger.info(f"sori - celebrity rekognition responsed. ")
    return [
        {'name': celeb['Name'], 'confidence': celeb['MatchConfidence']}
        for celeb in response['CelebrityFaces']
    ]

def process_image_upload(image_data: bytes, bucket_name: str, file_name: str) -> str:
    """Upload image to S3 and return object key."""
    file_key = f"path to imgs/{file_name}"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=file_key,
        Body=image_data,
        ContentType='image/jpeg'
    )
    return file_key


def lambda_handler(event, context):
    logger.info("sori Incoming request: %s", json.dumps(event))

    bucket = event['Records'][0]['s3']['bucket']['name']
    logger.info("sori bucket: %s", (bucket))
    key = event['Records'][0]['s3']['object']['key']
    response = s3_client.get_object(Bucket=bucket, Key=key)

    urls = json.loads(response['Body'].read())

    for url in urls:
        logger.info(f"sori - url: {url}")
        image_bytes = get_image_bytes(url)
        celebrities = detect_celebrities(image_bytes)
        logger.info(f"sori - celebrities found: {celebrities}")

        if len(celebrities) == 2:
            file_name = celebrities[0]['name'] + '_' + celebrities[1]['name'] + '.jpg'
            file_key = process_image_upload(image_bytes, bucket, file_name)
            logger.info(f"sori - Image uploaded to s3: %s", file_key)
        else:
            logger.info(f"sori - Nothing happened.")

    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }
