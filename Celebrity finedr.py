import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin


def get_image_bytes(image_url):
    """Fetch image bytes from URL"""
    try:
        response = requests.get(image_url, stream=True)
        response.raise_for_status()
        return response.content  # Returns image as bytes
    except Exception as e:
        print(f"Failed to fetch {image_url}: {str(e)}")
        return None


def crawl_images(url, max_images=20):
    """Crawl webpage and return dictionary of {image_url: image_bytes}"""
    try:
        # Fetch the webpage
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract image URLs
        image_urls = []
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src:
                # Convert to absolute URL
                if not src.startswith(('http://', 'https://')):
                    src = urljoin(url, src)
                image_urls.append(src)

        # Process images
        images_data = {}
        for img_url in image_urls[:max_images]:
            print(f"Fetching image from {img_url}")
            image_bytes = get_image_bytes(img_url)
            if image_bytes is not None:
                images_data[img_url] = image_bytes

        return images_data

    except Exception as e:
        print(f"Error crawling {url}: {str(e)}")
        return {}


# Example usage
if __name__ == '__main__':
    target_url = "https://www.imdb.com/gallery/rg403872512/?ref_=mv_close"
    images_dict = crawl_images(target_url)

    # Accessing the first image's bytes
    if images_dict:
        first_url = next(iter(images_dict))
        image_bytes = images_dict[first_url]
        print(f"\nFirst image bytes (type: {type(image_bytes)}):")
        print(f"Length: {len(image_bytes)} bytes")
        print(f"First 100 bytes: {image_bytes[:100]}...")
    else:
        print("No images found or downloaded")