#!/usr/bin/env python3
"""
Test Script - SIGMENT Backend
Tests basic functionality and logs detailed info
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_imports():
    """Test if all imports work"""
    print("🔍 Testing imports...")
    try:
        from app.api.dependencies import get_current_user, CurrentUser
        print("✅ Dependencies imported")
        
        from app.api.routes import unified_feed, social_feed, notes
        print("✅ Routes imported")
        
        from app.services.supabase_client import get_supabase
        print("✅ Supabase client imported")
        
        return True
    except Exception as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_env():
    """Test if environment variables are loaded"""
    print("\n🔍 Testing environment variables...")
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        required_vars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_KEY',
            'REDIS_URL'
        ]
        
        missing = []
        for var in required_vars:
            value = os.getenv(var)
            if value:
                # Mask sensitive data
                masked = value[:10] + '...' if len(value) > 10 else '***'
                print(f"✅ {var}: {masked}")
            else:
                missing.append(var)
                print(f"❌ {var}: NOT SET")
        
        if missing:
            print(f"\n❌ Missing env vars: {', '.join(missing)}")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Error loading env: {e}")
        return False

def test_supabase_connection():
    """Test Supabase connection"""
    print("\n🔍 Testing Supabase connection...")
    try:
        from app.services.supabase_client import get_supabase
        
        supabase = get_supabase()
        
        # Try a simple query
        response = supabase.table("organizations").select("id, name").limit(1).execute()
        
        if response.data:
            print(f"✅ Supabase connected! Found org: {response.data[0].get('name', 'N/A')}")
            return True
        else:
            print("⚠️  Supabase connected but no organizations found")
            return True
            
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_redis_connection():
    """Test Redis connection"""
    print("\n🔍 Testing Redis connection...")
    try:
        import redis
        from app.core.config import settings
        
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        print("✅ Redis connected!")
        return True
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        print("   Make sure Docker is running: docker-compose up -d")
        return False

def test_pydantic_models():
    """Test Pydantic models"""
    print("\n🔍 Testing Pydantic models...")
    try:
        from app.api.dependencies import CurrentUser
        from uuid import uuid4
        
        # Create a test user
        test_user = CurrentUser(
            id=uuid4(),
            email="test@test.com",
            organization_id=uuid4(),
            role="MEMBER",
            job_title="Test"
        )
        
        print(f"✅ CurrentUser model works: {test_user.email}")
        print(f"   - is_owner(): {test_user.is_owner()}")
        print(f"   - is_board_or_owner(): {test_user.is_board_or_owner()}")
        print(f"   - is_member(): {test_user.is_member()}")
        
        return True
    except Exception as e:
        print(f"❌ Pydantic model error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("🧪 SIGMENT Backend Test Suite")
    print("=" * 60)
    
    tests = [
        ("Imports", test_imports),
        ("Environment", test_env),
        ("Supabase", test_supabase_connection),
        ("Redis", test_redis_connection),
        ("Models", test_pydantic_models),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    print(f"\n📈 Score: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Backend is ready!")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
